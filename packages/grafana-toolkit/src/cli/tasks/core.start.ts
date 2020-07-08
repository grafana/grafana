//@ts-ignore
import concurrently from 'concurrently';
import { Task, TaskRunner } from './task';

interface StartTaskOptions {
  watchThemes: boolean;
  noTsCheck: boolean;
  measurePerf: boolean;
  hot: boolean;
}

const startTaskRunner: TaskRunner<StartTaskOptions> = async ({ watchThemes, noTsCheck, hot, measurePerf }) => {
  const noTsCheckArg = noTsCheck ? 1 : 0;
  const measurePerfArg = measurePerf ? 1 : 0;

  const startWebpackArgs = measurePerfArg ? `--progress` : `--progress --watch --colors`;
  const envWebpackArgs = `--env.noTsCheck=${noTsCheckArg} --env.measurePerf=${measurePerfArg}`;

  const jobs = [
    watchThemes && {
      command: 'nodemon -e ts -w ./packages/grafana-ui/src/themes -x yarn run themes:generate',
      name: 'SASS variables generator',
    },
    hot
      ? {
          command: 'webpack-dev-server --progress --colors --config scripts/webpack/webpack.hot.js',
          name: 'Dev server',
        }
      : {
          command: `webpack ${startWebpackArgs} ${envWebpackArgs} --config scripts/webpack/webpack.dev.js`,
          name: 'Webpack',
        },
  ];

  try {
    await concurrently(
      jobs.filter(job => !!job),
      {
        killOthers: ['failure', 'failure'],
        raw: true,
      }
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

export const startTask = new Task<StartTaskOptions>('Core startTask', startTaskRunner);
