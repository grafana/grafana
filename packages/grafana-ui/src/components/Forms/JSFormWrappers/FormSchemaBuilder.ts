import S, { BaseSchema, FORMATS } from 'fluent-schema';
import { UiSchema } from 'react-jsonschema-form';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';

type UIOptions<T = {}> = {
  label?: string;
  description?: string;
  defaultValue?: any;
  placeholder?: string;
  required?: boolean;
} & T;

interface InputOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  format?: FORMATS;
}

type UiSchemaOptions<T extends {}> = {
  placeholder?: string;
  widget?: string;
  uiOptions?: T;
};

const guessSchemaTypeFromValues = <T>(values: Array<SelectableValue<T>>) => {
  // Very naive for now
  const value = values[0];
  if (typeof value.value === 'string') {
    return S.string;
  }
  if (typeof value.value === 'number') {
    return S.number;
  }
  return S.string;
};

export class FormSchemaBuilder {
  private schema: any;
  private uiSchema: UiSchema = {
    'ui:rootFieldId': _.uniqueId('formBuilder'),
  };

  private requiredFields: string[] = [];

  constructor(name: string) {
    this.schema = S.object().title(name);
  }

  buildUISchemaForField = (name: string, options: UiSchemaOptions<any>) => {
    this.uiSchema[name] = {
      'ui:widget': options.widget,
      'ui:placeholder': options.placeholder,
      'ui:options': options.uiOptions,
    };
  };

  addTextInput = (name: string, options?: UIOptions<InputOptions>) => {
    return this.addField(
      name,
      () => {
        let schema = S.string();
        if (options) {
          if (options.format) {
            schema = schema.format(options.format);
          }
          if (options.maxLength) {
            schema = schema.maxLength(options.maxLength);
          }
          if (options.minLength) {
            schema = schema.minLength(options.minLength);
          }
          if (options.pattern) {
            schema = schema.pattern(options.pattern);
          }
        }

        return schema;
      },
      options
    );
  };

  addNumberInput = (name: string, options?: UIOptions) => {
    return this.addField(name, S.number, options);
  };

  addSelect = <T>(name: string, values: Array<SelectableValue<T>>, options?: UIOptions) => {
    return this.addField(
      name,
      () => {
        const schemaFactory = guessSchemaTypeFromValues(values);
        return schemaFactory().enum(values.map(v => v.value!));
      },
      options
    );
  };

  addSwitch = (name: string, horizontal = false, options?: UIOptions) => {
    return this.addBooleanInput<{ horizontal: boolean }>(name, true, {
      ...options,
      uiOptions: {
        horizontal,
      },
    });
  };

  private addBooleanInput = <T>(name: string, useSwitch = false, options?: UIOptions & UiSchemaOptions<T>) => {
    return this.addField(name, S.boolean, { ...options, widget: 'switch' });
  };

  private addField = <T extends BaseSchema<any>, E>(
    name: string,
    schemaFactory: () => T,
    uiOptions?: UIOptions<E> & UiSchemaOptions<any>
  ) => {
    let propertySchema = schemaFactory();
    if (uiOptions) {
      if (uiOptions.defaultValue) {
        propertySchema = propertySchema.default(uiOptions.defaultValue);
      }
      if (uiOptions.label) {
        propertySchema = propertySchema.title(uiOptions.label);
      }
      if (uiOptions.description) {
        propertySchema = propertySchema.description(uiOptions.description);
      }

      this.buildUISchemaForField(name, {
        placeholder: uiOptions.placeholder,
        widget: uiOptions.widget,
        uiOptions: uiOptions.uiOptions,
      });
      if (uiOptions.required) {
        this.requiredFields.push(name);
      }
    }

    this.schema = this.schema.prop(name, propertySchema);
    console.log(this.schema.valueOf());
    return this;
  };

  getSchema = () => {
    return this.schema;
  };

  getFormProps = () => {
    const schema = S.object()
      .extend(this.schema)
      .required(this.requiredFields);
    return {
      schema: schema.valueOf(),
      uiSchema: this.uiSchema,
    };
  };
}
