import { ExtensionsLog } from './logs/log';

export abstract class LogMessageBuilder {
  protected errors: string[];
  protected warnings: string[];
  constructor(
    protected log: ExtensionsLog,
    protected pluginId: string
  ) {
    this.errors = [];
    this.warnings = [];
  }

  get HasErrors() {
    return this.errors.length > 0;
  }

  abstract print(log: ExtensionsLog): void;
}

abstract class ExtensionsLogMessage extends LogMessageBuilder {
  constructor(
    protected log: ExtensionsLog,
    protected pluginId: string,
    private typeFriendlyName: string,
    private sectionName: string
  ) {
    super(log, pluginId);
  }

  addMissingExtensionMetaError() {
    this.errors.push(
      `The extension was not recorded in the plugin.json. ${this.typeFriendlyName} extensions must be listed in the section "${this.sectionName}".`
    );
  }

  addMissingExtensionMetaWarning() {
    this.warnings.push(
      `The extension was not recorded in the plugin.json. ${this.typeFriendlyName} extensions must be listed in the section "${this.sectionName}". Currently, this is only required in development but it  Currently, this is only required in development but will be enforced also in production builds in the future.`
    );
  }

  addMissingVersionSuffixWarning() {
    this.warnings.push(
      `It's recommended to suffix the extension point id with a version, e.g 'myorg-basic-app/extension-point/v1'.`
    );
  }

  addTitleMismatchError() {
    this.errors.push(`The title of the ${this.typeFriendlyName} does not match the title specified in plugin.json.`);
  }

  addInvalidExtensionTargetsWarning() {
    this.warnings.push(
      `The registered targets for the registered extension does not match the targets listed in the section "${this.sectionName}" of the plugin.json file. Currently, this is only required in development but it  Currently, this is only required in development but will be enforced also in production builds in the future.`
    );
  }

  addInvalidExtensionTargetsError() {
    this.errors.push(
      `The registered targets for the registered extension does not match the targets listed in the section "${this.sectionName}" of the plugin.json file.`
    );
  }

  addTitleMissingError() {
    this.errors.push('Title is missing.');
  }

  addDescriptionMissingError() {
    this.errors.push('Description is missing.');
  }

  print(): void {
    if (this.errors.length) {
      const line = `Could not register ${this.typeFriendlyName.toLocaleLowerCase()} extension. Errors: \n${this.errors.join('\n')}\n Warnings: \n${this.warnings.join('\n')}`;
      this.warnings.length && line.concat(`\n Warnings: \n${this.warnings.join('\n')}`);
      this.log.error(line);
    } else if (this.warnings.length) {
      this.log.warning(
        `${this.typeFriendlyName} successfully registered with the following warnings: \n${this.warnings.join('\n')}`
      );
    } else {
      this.log.debug(`${this.typeFriendlyName} extension successfully registered.`);
    }
  }
}

export class AddedLinkLogMessage extends ExtensionsLogMessage {
  constructor(
    protected log: ExtensionsLog,
    protected pluginId: string
  ) {
    super(log, pluginId, 'Added link', 'extensions.addedLinks[]');
  }

  addInvalidConfigureFnError() {
    this.errors.push('Invalid "configure" function. It should be a function.');
  }

  addInvalidPathOrOnClickError() {
    this.errors.push('You need to provide either "path" or "onClick".');
  }

  addInvalidLinkPathError() {
    this.errors.push('The "path" is required and should start with "/a/{pluginId}/".');
  }
}

export class AddedComponentLogMessage extends ExtensionsLogMessage {
  constructor(
    protected log: ExtensionsLog,
    protected pluginId: string
  ) {
    super(log, pluginId, 'Added component', 'extensions.addedComponents[]');
  }
}

export class ExposedComponentLogMessage extends ExtensionsLogMessage {
  constructor(
    protected log: ExtensionsLog,
    protected pluginId: string
  ) {
    super(log, pluginId, 'Exposed component', 'extensions.exposedComponents[]');
  }

  addInvalidComponentIdError() {
    this.errors.push(
      "The component id does not match the id naming convention. Id should be prefixed with plugin id. e.g 'myorg-basic-app/my-component-id/v1'."
    );
  }

  addComponentAlreadyExistsError() {
    this.errors.push('An exposed component with the same id already exists.');
  }

  addMissingDependencyInfoWarning() {
    this.warnings.push(
      'The exposed component is not recorded in the "plugin.json" file. Exposed components must be listed in the dependencies[] section. Currently, this is only required in development but it will be enforced also in production builds in the future.'
    );
  }

  addMissingDependencyInfoError() {
    this.errors.push(
      'The exposed component is not recorded in the "plugin.json" file. Exposed components must be listed in the dependencies[] section.'
    );
  }
}

export class ExtensionPointLogMessage extends LogMessageBuilder {
  constructor(
    protected log: ExtensionsLog,
    protected pluginId: string
  ) {
    super(log, pluginId);
  }

  get InvalidIdError() {
    return `Extension point id should be prefixed with your plugin id, e.g "myorg-foo-app/toolbar/v1".`;
  }

  addMissingMetaInfoError() {
    this.errors.push(
      'The extension point is not recorded in the "plugin.json" file. Extension points must be listed in the section "extensions.extensionPoints[]". Returning an empty array of extensions.'
    );
  }

  addMissingMetaInfoWarning() {
    this.errors.push(
      'The extension point is not recorded in the "plugin.json" file. Extension points must be listed in the section "extensions.extensionPoints[]". Currently, this is only required in development but it will be enforced also in production builds in the future.'
    );
  }

  addInvalidIdError() {
    this.errors.push(this.InvalidIdError);
  }

  print(): void {
    if (this.errors.length) {
      this.log.error(`Could not use extension point. Reasons: \n${this.errors.join('\n')}`);
    } else if (this.warnings.length) {
      this.log.warning(`The extension point has the following warnings: \n${this.warnings.join('\n')}`);
    }
  }
}
