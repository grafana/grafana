import * as fs_ from 'fs-extra';


export function mkdir(
    path: fs_.PathLike,
    options?: number | string | fs_.MakeDirectoryOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      fs_.mkdir(path, options, (err) => {
        if (!err) { resolve(); }else { reject(err); }
      });
    });
}

export function rmdir(path) {
  fs_.removeSync(path);
}

export function writeFile(
  path: fs_.PathLike | number, data: any,
  options?: fs_.WriteFileOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    fs_.writeFile(path, data, options, (err) => {
      if (!err) { resolve(); }else { reject(err); }
    });
  });
}

export function readFile(
  path: fs_.PathLike | number,
  options?: { encoding?: string | null; flag?: string; } | string
): Promise<string | Buffer> {
  return new Promise<string | Buffer>((resolve, reject) => {
    fs_.readFile(path, options, (err, data) => {
      if (!err) { resolve(data); }else { reject(err); }
    });
  });
}

export function exists(path) {
  return fs_.existsSync(path);
}
