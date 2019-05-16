export type TaskRunner<T> = (options: T) => Promise<any>;

export class Task<TOptions> {
  name: string;
  runner: (options: TOptions) => Promise<any>;
  options: TOptions;

  setName = name => {
    this.name = name;
  };

  setRunner = (runner: TaskRunner<TOptions>) => {
    this.runner = runner;
  };

  setOptions = options => {
    this.options = options;
  };

  exec = () => {
    return this.runner(this.options);
  };
}
