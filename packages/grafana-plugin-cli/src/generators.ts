import * as fs from 'src/utils';

import * as ejs from 'ejs';
import * as _ from 'lodash';

import * as path from 'path';


export type FunctionValue<V, T> = ((context: GenerationContext<T>) => FunctionValue<V, T>) | V;
export type FunctionArray<V, T> = FunctionValue<Array<FunctionValue<V[] | V, T>>, T>;
export type ContextModifier<T> = (context: GenerationContext<T>) => void;


export function resolveFunctionValue<V, T>(fv: FunctionValue<V, T>, context: GenerationContext<T>): V {
  while (_.isFunction(fv)) {
    fv = fv(context);
  }
  return fv;
}

function resolveFunctionArray<V, T>(array: FunctionArray<V, T>, context: GenerationContext<T>): V[] {
  const arr = resolveFunctionValue(array, context);
  return _.flatMap(arr, e => resolveFunctionValue(e, context));
}

function resolveContextModifier<T>(context: GenerationContext<T>, map?: ContextModifier<T>): GenerationContext<T> {
  if (map === undefined) {
    return context;
  }
  const newContext = _.clone(context);
  map(newContext);
  return newContext;
}

export class GenerationContext<T> {
  options: T;
  workingDirectory: string;

  constructor(options: T) {
    this.options = options;
  }
}

export interface Generator<T> {
  /**
   * generate anything in context
   */
  generate(context: GenerationContext<T>): Promise<void>;
}

export class TemplateGenerator<T> implements Generator<T> {

  constructor(
    private _template: string,
    private _targetName: FunctionValue<string, T>,
    private _contextMap?: ContextModifier<T>
  ) {
  }

  async generate(context: GenerationContext<T>) {
    const targetName = resolveFunctionValue(this._targetName, context);
    const targetPath = path.join(context.workingDirectory, targetName);
    const innterContext = resolveContextModifier(context, this._contextMap);
    const result = ejs.render(this._template, innterContext);
    await fs.writeFile(targetPath, result);
  }
}

export class FolderGenerator<T> implements Generator<T> {

  constructor(
    private _folderName: FunctionValue<string, T>,
    private _innerGenerators: FunctionArray<Generator<T>, T>,
    private _contextMap?: ContextModifier<T>
  ) {

  }

  async generate(context: GenerationContext<T>) {
    const folderName = resolveFunctionValue(this._folderName, context);

    let innerContext: any = _.clone(context);
    innerContext.workingDirectory = path.join(context.workingDirectory, folderName);
    innerContext = resolveContextModifier(innerContext, this._contextMap);
    const innerGenerators = resolveFunctionArray(this._innerGenerators, context);

    if (innerContext.options.overWriteDir === true) {
      await fs.rmdir(innerContext.workingDirectory);
    } else if (innerContext.options.overWriteDir === false) {
      console.log('Aborting');
      process.exit(0);
    }

    await fs.mkdir(innerContext.workingDirectory);
    await Promise.all(innerGenerators.map(g => g.generate(innerContext)));

  }

}
