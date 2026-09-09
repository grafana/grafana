import { config } from '@grafana/runtime';
import { type FormatVariable, type SceneObject } from '@grafana/scenes';

/**
 * Handles expressions like ${__namespace}, the Kubernetes namespace backing the current
 * organization. App Platform API paths are all namespaced, so queries against them need
 * it to build the URL.
 */
export class NamespaceMacro implements FormatVariable {
  public state: { name: string; type: string };

  public constructor(name: string, _: SceneObject) {
    this.state = { name: name, type: 'namespace_macro' };
  }

  public getValue(): string {
    return config.namespace;
  }
}
