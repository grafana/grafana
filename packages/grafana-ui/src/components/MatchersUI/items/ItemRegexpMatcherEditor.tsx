import { memo, useCallback, useState } from 'react';

import { ItemMatcherID, itemMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Input } from '../../Input/Input';

import { type ItemMatcherUIProps, type ItemMatcherUIRegistryItem } from './types';

export const ItemRegexpMatcherEditor = memo<ItemMatcherUIProps<string>>((props) => {
  const { id, options, onChange } = props;
  // Commit on blur rather than on every keystroke, so a half-typed pattern does not
  // repaint the panel with a match set the user did not ask for.
  const [pattern, setPattern] = useState(options ?? '');

  const onBlur = useCallback(() => {
    if (pattern !== options) {
      onChange(pattern);
    }
  }, [pattern, options, onChange]);

  return (
    <Input
      id={id}
      placeholder={t('grafana-ui.item-matchers-ui.placeholder-item-regexp', 'Enter regular expression')}
      value={pattern}
      onChange={(e) => setPattern(e.currentTarget.value)}
      onBlur={onBlur}
    />
  );
});
ItemRegexpMatcherEditor.displayName = 'ItemRegexpMatcherEditor';

export const getItemRegexpMatcherItem: () => ItemMatcherUIRegistryItem<string> = () => ({
  id: ItemMatcherID.byItemRegexp,
  component: ItemRegexpMatcherEditor,
  matcher: itemMatchers.get(ItemMatcherID.byItemRegexp),
  name: t('grafana-ui.item-matchers-ui.name-items-with-name-matching-regex', 'Items with name matching regex'),
  description: t(
    'grafana-ui.item-matchers-ui.description-items-with-name-matching-regex',
    'Set properties for items whose name matches a regular expression'
  ),
  optionsToLabel: (options) => options ?? '',
});
