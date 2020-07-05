module.exports = {
  extends: ['@grafana/eslint-config'],
  root: true,
  overrides: [
    {
      files: ['**/grafana-toolkit/**/*.*.ts'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
  ],
};
