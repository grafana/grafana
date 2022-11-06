module.exports = {
  extends: ['@grafana/eslint-config'],
  rules: {
    'react/prop-types': 'off',
    '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
  },
};
