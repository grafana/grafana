const platforms = {
  osx: 'darwin',
  windows: 'win32',
  linux: 'linux',
  aix: 'aix',
  freebsd: 'freebsd',
  openbsd: 'openbsd',
  sunos: 'sunos',
};

export const undo = () => {
  switch (Cypress.platform) {
    case platforms.osx:
      return '{cmd}z';
    default:
      return '{ctrl}z';
  }
};
