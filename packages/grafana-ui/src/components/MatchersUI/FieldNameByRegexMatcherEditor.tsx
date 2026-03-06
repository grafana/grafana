import { memo, useMemo, useState } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { MatcherScopeSelector } from './MatcherScopeSelector';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { useFieldDisplayNames } from './utils';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { id, options, onChange, data, scope = 'series', allowedScopes } = props;
  const [regexp, setRegexp] = useState(options);
  const names = useFieldDisplayNames(data);
  const uniqScopes = useMemo(() => new Set([...names.scopes.values()]), [names]);

  return (
    <Stack gap={1} direction="column">
      <Input
        id={id}
        placeholder={t('grafana-ui.field-name-by-regex-matcher.input-placeholder', 'Enter regular expression')}
        value={regexp}
        onChange={(e) => setRegexp(e.currentTarget.value)}
        onBlur={() => onChange(regexp, scope)}
      />
      <MatcherScopeSelector
        scope={scope}
        scopes={uniqScopes}
        onChange={(newScope) => onChange(regexp, newScope)}
        allowedScopes={allowedScopes}
      />
    </Stack>
  );
});

FieldNameByRegexMatcherEditor.displayName = 'FieldNameByRegexMatcherEditor';

export const getFieldNameByRegexMatcherItem: () => FieldMatcherUIRegistryItem<string> = () => ({
  id: FieldMatcherID.byRegexp,
  component: FieldNameByRegexMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byRegexp),
  name: t('grafana-ui.matchers-ui.name-field-name-by-regex-matcher', 'Fields with name matching regex'),
  description: t(
    'grafana-ui.matchers-ui.description-field-name-by-regex-matcher',
    'Set properties for fields with names matching a regex'
  ),
  optionsToLabel: (options) => options,
});
