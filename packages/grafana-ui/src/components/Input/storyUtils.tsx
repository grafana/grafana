import React from 'react';

import { toIconName } from '@grafana/data';

import { Icon } from '../Icon/Icon';

export function parseAccessory(prefix: string | undefined) {
  const icon = prefix && prefix.match(/icon-/g) && toIconName(prefix.replace(/icon-/g, ''));

  if (icon) {
    const icon = toIconName(prefix.replace(/icon-/g, '')) ?? 'question-circle';
    return <Icon name={icon} />;
  }

  return prefix;
}
