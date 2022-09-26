import React from 'react';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

interface RuledEditorWrapperProps {
  edit?: boolean;
  children: React.ReactNode;
}

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell',
  id: 'alert-rule-view',
  breadcrumbs: [{ title: 'Alerting', url: 'alerting/list' }],
};

export function RuleEditorWrapper({ edit, children }: RuledEditorWrapperProps) {
  return (
    <Page navId="alert-list" pageNav={{ ...defaultPageNav, text: edit ? 'Edit Rule' : 'Add Rule' }}>
      <Page.Contents>{children}</Page.Contents>
    </Page>
  );
}
