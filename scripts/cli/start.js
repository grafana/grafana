const concurrently = require('concurrently');

const startTask = async () => {
  try {
    const res = await concurrently([
      {
        command: 'nodemon -e ts -w ./packages/grafana-ui/src/themes -x yarn run themes:generate',
        name: 'SASS variables generator',
      },
      {
        command: 'webpack-dev-server --progress --colors --mode development --config scripts/webpack/webpack.hot.js',
        name: 'Dev server',
      },
    ], {
      killOthers: ['failure', 'failure'],
  });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

startTask();
