const cwd = process.cwd();

export const changeCwdToGrafanaUi = () => {
  process.chdir(`${cwd}/packages/grafana-ui`);
  return process.cwd();
};

export const changeCwdToGrafanaToolkit = () => {
  process.chdir(`${cwd}/packages/grafana-toolkit`);
  return process.cwd();
};

export const changeCwdToGrafanaUiDist = () => {
  process.chdir(`${cwd}/packages/grafana-ui/dist`);
};

export const restoreCwd = () => {
  process.chdir(cwd);
};
