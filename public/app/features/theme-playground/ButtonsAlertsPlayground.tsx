/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  type AlertVariant,
  Button,
  type ButtonVariant,
  type ComponentSize,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { HOME_NAV_ID } from '../../core/reducers/navModel';
import { getNavModel } from '../../core/selectors/navModel';
import { useSelector } from '../../types/store';

type ButtonFill = 'solid' | 'outline' | 'text';

const buttonFills: ButtonFill[] = ['solid', 'outline', 'text'];
const buttonSizes: ComponentSize[] = ['xs', 'sm', 'md', 'lg'];
const buttonVariants: ButtonVariant[] = ['primary', 'secondary', 'destructive', 'success', 'accent'];
const alertVariants: AlertVariant[] = ['error', 'warning', 'success', 'info'];

export default function ButtonsAlertsPlayground() {
  const navIndex = useSelector((state) => state.navIndex);
  const homeNav = getNavModel(navIndex, HOME_NAV_ID).main;
  const navModel = {
    text: t('buttons-alerts-playground.title', 'Buttons & alerts playground'),
    parentItem: homeNav,
  };
  const styles = useStyles2(getStyles);

  return (
    <Page
      navModel={{
        node: navModel,
        main: navModel,
      }}
    >
      <Page.Contents>
        <div className={styles.section}>
          <Text element="h2">Buttons</Text>
          <Stack direction="column" gap={4}>
            {buttonFills.map((fill) => (
              <div key={fill}>
                <Text weight="bold">fill=&quot;{fill}&quot;</Text>
                <Stack direction="column" gap={2}>
                  {buttonSizes.map((size) => (
                    <Stack key={size} alignItems="center" wrap="wrap">
                      <div className={styles.sizeLabel}>
                        <Text color="secondary">{size}</Text>
                      </div>
                      {buttonVariants.map((variant) => (
                        <Button variant={variant} fill={fill} size={size} key={variant}>
                          {variant}
                        </Button>
                      ))}
                      <Button variant="primary" fill={fill} size={size} disabled>
                        disabled
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        </div>

        <div className={styles.section}>
          <Text element="h2">Alerts</Text>
          <Stack direction="column" gap={2}>
            {alertVariants.map((severity) => (
              <Alert key={severity} severity={severity} title={`${severity} alert title`}>
                This is the body content for a {severity} alert.
              </Alert>
            ))}
            <Alert
              severity="error"
              title="Error alert with actions"
              buttonContent="Close"
              onRemove={() => {}}
              action={<Button variant="secondary">Secondary action</Button>}
            >
              This alert has a dismiss button and an extra action button.
            </Alert>
          </Stack>
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    marginBottom: theme.spacing(4),
  }),
  sizeLabel: css({
    width: theme.spacing(4),
  }),
});
