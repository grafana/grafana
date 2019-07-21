export type TaskRunner<T> = (options: T) => Promise<any>;

export class Task<TOptions> {
  options: TOptions = {} as any;

  constructor(public name: string, public runner: TaskRunner<TOptions>) {}
  setName = (name: string) => {
    this.name = name;
  };

  setRunner = (runner: TaskRunner<TOptions>) => {
    this.runner = runner;
  };

  setOptions = (options: TOptions) => {
    this.options = options;
  };

  exec = () => {
    return this.runner(this.options);
  };
}
