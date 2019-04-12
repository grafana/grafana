export type TaskRunner<T> = (options: T) => Promise<void>;

export class Task<TOptions> {
  name: string;
  runner: (options: TOptions) => Promise<void>;
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
