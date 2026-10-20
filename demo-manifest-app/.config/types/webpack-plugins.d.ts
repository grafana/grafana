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

declare module 'webpack-livereload-plugin' {
  import { ServerOptions } from 'https';
  import { Compiler, Plugin, Stats, Compilation } from 'webpack';

  interface Options extends Pick<ServerOptions, 'cert' | 'key' | 'pfx'> {
    /**
     * protocol for livereload `<script>` src attribute value
     * @default protocol of the page, either `http` or `https`
     */
    protocol?: string | undefined;
    /**
     * The desired port for the livereload server.
     * If you define port 0, an available port will be searched for, starting from 35729.
     * @default 35729
     */
    port?: number | undefined;
    /**
     * he desired hostname for the appended `<script>` (if present) to point to
     * @default hostname of the page, like `localhost` or 10.0.2.2
     */
    hostname?: string | undefined;
    /**
     * livereload `<script>` automatically to `<head>`.
     * @default false
     */
    appendScriptTag?: boolean | undefined;
    /**
     * RegExp of files to ignore. Null value means ignore nothing.
     * It is also possible to define an array and use multiple anymatch patterns
     */
    ignore?: RegExp | RegExp[] | null | undefined;
    /**
     * amount of milliseconds by which to delay the live reload (in case build takes longer)
     * @default 0
     */
    delay?: number | undefined;
    /**
     * create hash for each file source and only notify livereload if hash has changed
     * @default false
     */
    useSourceHash?: boolean | undefined;
  }

  class LiveReloadPlugin extends Plugin {
    readonly isRunning: boolean;
    constructor(options?: Options);

    apply(compiler: Compiler): void;

    start(watching: any, cb: () => void): void;
    done(stats: Stats): void;
    failed(): void;
    autoloadJs(): string;
    scriptTag(source: string): string;
    applyCompilation(compilation: Compilation): void;
  }

  export = LiveReloadPlugin;
}
