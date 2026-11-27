import { t, Trans } from '@grafana/i18n';
import { Dropdown, IconButton, Menu, MenuItem, Text } from '@grafana/ui';

import { useFeatureControlContext } from './FeatureControlProvider';

export const FeatureControlMenu = () => {
  const { setIsOpen, setIsAccessible, overrides, isSuspended, resetToDefaults, restoreOverrides } =
    useFeatureControlContext();

  const overlay = (
    <Menu onOpen={(focusOnItem) => focusOnItem(-1)}>
      {isSuspended ? (
        <MenuItem
          icon="history"
          label={t('feature-control.restore-overrides', 'Restore overrides')}
          onClick={restoreOverrides}
        />
      ) : (
        <MenuItem
          icon="history"
          label={t('feature-control.disable-overrides', 'Disable overrides')}
          onClick={resetToDefaults}
          disabled={overrides.length === 0}
        />
      )}
      <MenuItem
        destructive
        icon="trash-alt"
        label={t('feature-control.dismiss.label', 'Remove UI and toolbar button')}
        onClick={() => {
          setIsOpen(false);
          setIsAccessible(false);
        }}
        component={() => (
          <Text color="secondary" variant="bodySmall" textAlignment="start">
            <Trans i18nKey="feature-control.dismiss.tooltip" values={{ param: '?featureControl=true' }}>
              Any feature flag overrides defined will remain active.
              <br /> Use <code>{'{{ param }}'}</code> in the URL to enable UI again.
            </Trans>
          </Text>
        )}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={overlay} placement="bottom-end">
      <IconButton tooltip={t('feature-control.menu', 'Open menu')} variant="secondary" name="ellipsis-v" />
    </Dropdown>
  );
};
