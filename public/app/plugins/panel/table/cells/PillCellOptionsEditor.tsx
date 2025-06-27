import React from 'react';

import { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TablePillCellOptions } from '@grafana/schema';
import { Field, Input, Select } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const pillStyle = (color?: string) => ({
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '999px',
  background: color || '#e0e0e0',
  color: '#222',
  fontWeight: 500,
  fontSize: '0.95em',
  marginTop: 8,
});

export const PillCellOptionsEditor: React.FC<TableCellEditorProps<TablePillCellOptions>> = ({ cellOptions, onChange }) => {
  const pillIconOptions: Array<{ label: string; value: IconName }> = [
    { label: t('table.pill.icon.check', 'Check'), value: 'check' },
    { label: t('table.pill.icon.info', 'Info'), value: 'info-circle' },
    { label: t('table.pill.icon.alert', 'Alert'), value: 'exclamation-triangle' },
    { label: t('table.pill.icon.star', 'Star'), value: 'favorite' },
    { label: t('table.pill.icon.clock', 'Clock'), value: 'clock-nine' },
    { label: t('table.pill.icon.none', 'None'), value: '' as IconName },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field label={t('table.pill.color', 'Color')} description={t('table.pill.color.desc', 'Background color for all pills.')}>
        <Input
          type="color"
          value={cellOptions.color ?? '#e0e0e0'}
          onChange={e => onChange({ ...cellOptions, color: e.currentTarget.value })}
          style={{ width: 40, height: 32, padding: 0, border: 'none', background: 'none' }}
        />
      </Field>
      <Field label={t('table.pill.icon', 'Icon')} description={t('table.pill.icon.desc', 'Icon to display in each pill.')}> 
        <Select
          options={pillIconOptions}
          value={pillIconOptions.find(opt => opt.value === (cellOptions.icon ?? ''))}
          onChange={v => onChange({ ...cellOptions, icon: v.value })}
          isClearable
        />
      </Field>
      <div>
        <div style={pillStyle(cellOptions.color)}>
          {cellOptions.label || 'Pill preview'}
        </div>
      </div>
    </div>
  );
};
 
