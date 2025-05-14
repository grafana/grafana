import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';

import { Button, Field, Icon, Input, Stack, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useURLSearchParams } from '../../../hooks/useURLSearchParams';

const ContactPointsFilter = () => {
  const styles = useStyles2(getStyles);

  const [searchParams, setSearchParams] = useURLSearchParams();

  const defaultValue = searchParams.get('search') ?? '';
  const [searchValue, setSearchValue] = useState(defaultValue);

  const [_, cancel] = useDebounce(
    () => {
      setSearchParams({ search: searchValue }, true);
    },
    300,
    [setSearchParams, searchValue]
  );

  const clear = useCallback(() => {
    cancel();
    setSearchValue('');
    setSearchParams({ search: '' }, true);
  }, [cancel, setSearchParams]);

  const hasInput = Boolean(defaultValue);

  return (
    <Stack direction="row" alignItems="end" gap={0.5}>
      <Field
        className={styles.noBottom}
        label={t('alerting.contact-points-filter.label-search-by-name-or-type', 'Search by name or type')}
      >
        <Input
          aria-label={t('alerting.contact-points-filter.aria-label-search-contact-points', 'search contact points')}
          placeholder={t('alerting.contact-points-filter.placeholder-search', 'Search')}
          width={46}
          prefix={<Icon name="search" />}
          onChange={(event) => {
            setSearchValue(event.currentTarget.value);
          }}
          value={searchValue}
        />
      </Field>
      <Button
        variant="secondary"
        icon="times"
        onClick={() => clear()}
        disabled={!hasInput}
        aria-label={t('alerting.contact-points-filter.aria-label-clear', 'clear')}
      >
        <Trans i18nKey="alerting.contact-points-filter.clear">Clear</Trans>
      </Button>
    </Stack>
  );
};

const getStyles = () => ({
  noBottom: css({
    marginBottom: 0,
  }),
});

export { ContactPointsFilter };
