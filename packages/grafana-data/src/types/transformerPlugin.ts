import {TransformerRegistryItem, TransformerUIProps} from '../transformations';
import {KeyValue} from './data';
import {GrafanaPlugin, PluginMeta} from './plugin';
import {DataTransformerInfo} from "./transformations";
import {ComponentType} from "react";

export interface TransformerDef<TOptions> {
  editor: ComponentType<TransformerUIProps<TOptions>>
  transformation: DataTransformerInfo<TOptions>
}

export interface TransformerPluginMeta<T extends KeyValue = KeyValue> extends PluginMeta<T> {
  // TODO anything specific to transformers ?
}

export class TransformerPlugin<T extends KeyValue = KeyValue> extends GrafanaPlugin<TransformerPluginMeta<T>> {
  private _transformers: TransformerDef<any>[] = [];

  constructor() {
    super();
  }

  get transformers() : TransformerRegistryItem<any>[] {
    const res = this._transformers.map(t => ({
      editor: t.editor,
      transformation: t.transformation,
      name: t.transformation.name,
      description: t.transformation.description,
      id: this.meta.id + '-' + t.transformation.id,
      state: t.transformation.state || this.meta.state,
    }))
    return res;
  }

  registerTransformer(transformer: TransformerDef<any>) {
    this._transformers.push(transformer);
    return this;
  }
}

