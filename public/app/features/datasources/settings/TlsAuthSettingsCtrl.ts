import { coreModule } from 'app/core/core';

coreModule.directive('datasourceTlsAuthSettings', () => {
  return {
    scope: {
      current: '=',
    },
    templateUrl: 'public/app/features/datasources/partials/tls_auth_settings.html',
  };
});
