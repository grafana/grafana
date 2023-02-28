import React from 'react';

import { Branding } from '../../../../core/components/Branding/Branding';

export const PublicDashboardNotAvailable = ({ paused }: { paused?: boolean }) => (
  <Branding.LoginBackground>
    <div>
      <p>Veamos</p>
      {paused ? <p>Pausado</p> : <p>Eliminado</p>}
    </div>
  </Branding.LoginBackground>
);
