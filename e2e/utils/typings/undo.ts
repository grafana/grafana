// https://nodejs.org/api/os.html#os_os_platform
enum Platform {
  osx = 'darwin',
  windows = 'win32',
  linux = 'linux',
  aix = 'aix',
  freebsd = 'freebsd',
  openbsd = 'openbsd',
  sunos = 'sunos',
}

export const undo = () => {
  switch (Cypress.platform) {
    case Platform.osx:
      return '{cmd}z';
    default:
      return '{ctrl}z';
  }
};
