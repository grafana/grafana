declare module 'replace-in-file-webpack-plugin' {
  import { Compiler, Plugin } from 'webpack';

  interface ReplaceRule {
    search: string | RegExp;
    replace: string | ((match: string) => string);
  }

  interface ReplaceOption {
    dir?: string;
    files?: string[];
    test?: RegExp | RegExp[];
    rules: ReplaceRule[];
  }

  class ReplaceInFilePlugin extends Plugin {
    constructor(options?: ReplaceOption[]);
    options: ReplaceOption[];
    apply(compiler: Compiler): void;
  }

  export = ReplaceInFilePlugin;
}
