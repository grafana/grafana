import React, { useState } from 'react';

import { Button } from '@grafana/ui';

import { EmbeddedDashboard } from './EmbeddedDashboard';

export interface PreviewDashboardButtonProps {
  uid: string;
  children: React.ReactNode;
}

export function PreviewDashboardButton({ uid, children }: PreviewDashboardButtonProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setShowPreview(true)}>
        {children}
      </Button>
      {showPreview && <EmbeddedDashboard uid={uid} inDrawer={true} onClose={() => setShowPreview(false)} />}
    </>
  );
}
