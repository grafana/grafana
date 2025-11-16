import { css, cx } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2, renderMarkdown, LinkModelSupplier, ScopedVars, IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, getTemplateSrv } from '@grafana/runtime';
import { Tooltip, PopoverContent, Icon, useStyles2 } from '@grafana/ui';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { InspectTab } from 'app/features/inspector/types';

enum InfoMode {
  Error = 'Error',
  Info = 'Info',
  Links = 'Links',
}

export interface Props {
  panel: PanelModel;
  title?: string;
  description?: string;
  scopedVars?: ScopedVars;
  links?: LinkModelSupplier<PanelModel>;
  error?: string;
}

export function PanelHeaderCorner({ panel, links, error }: Props) {
  const styles = useStyles2(getContentStyles);

  const getInfoMode = useCallback(() => {
    if (error) {
      return InfoMode.Error;
    }
    if (!!panel.description) {
      return InfoMode.Info;
    }
    if (panel.links && panel.links.length) {
      return InfoMode.Links;
    }

    return undefined;
  }, [panel, error]);

  const getInfoContent = useCallback((): JSX.Element => {
    const markdown = panel.description || '';
    const interpolatedMarkdown = getTemplateSrv().replace(markdown, panel.scopedVars);
    const markedInterpolatedMarkdown = renderMarkdown(interpolatedMarkdown);
    const linksList = links && links.getLinks(panel.replaceVariables);

    return (
      <div className={styles.content}>
        <div dangerouslySetInnerHTML={{ __html: markedInterpolatedMarkdown }} />

        {linksList && linksList.length > 0 && (
          <ul className={styles.cornerLinks}>
            {linksList.map((link, idx) => {
              return (
                <li key={idx}>
                  <a href={link.href} target={link.target}>
                    {link.title}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }, [panel, links, styles]);

  /**
   * Open the Panel Inspector when we click on an error
   */
  const onClickError = useCallback(() => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: InspectTab.Error,
    });
  }, [panel.id]);

  const infoMode: InfoMode | undefined = getInfoMode();

  if (!infoMode) {
    return null;
  }

  if (infoMode === InfoMode.Error && error) {
    return <PanelInfoCorner infoMode={infoMode} content={error} onClick={onClickError} />;
  }

  if (infoMode === InfoMode.Info || infoMode === InfoMode.Links) {
    return <PanelInfoCorner infoMode={infoMode} content={getInfoContent} />;
  }

  return null;
}

export default PanelHeaderCorner;

interface PanelInfoCornerProps {
  infoMode: InfoMode;
  content: PopoverContent;
  onClick?: () => void;
}

function PanelInfoCorner({ infoMode, content, onClick }: PanelInfoCornerProps) {
  const theme = infoMode === InfoMode.Error ? 'error' : 'info';
  const ariaLabel = selectors.components.Panels.Panel.headerCornerInfo(infoMode.toLowerCase());
  const styles = useStyles2(getStyles);

  return (
    <Tooltip content={content} placement="top-start" theme={theme} interactive>
      <button type="button" className={styles.infoCorner} onClick={onClick} aria-label={ariaLabel}>
        <Icon
          name={iconMap[infoMode]}
          size={infoMode === InfoMode.Links ? 'sm' : 'lg'}
          className={cx(styles.icon, { [styles.iconLinks]: infoMode === InfoMode.Links })}
        />
        <span className={cx(styles.inner, { [styles.error]: infoMode === InfoMode.Error })} />
      </button>
    </Tooltip>
  );
}

const iconMap: Record<InfoMode, IconName> = {
  [InfoMode.Error]: 'exclamation',
  [InfoMode.Info]: 'info',
  [InfoMode.Links]: 'external-link-alt',
};

const getContentStyles = (theme: GrafanaTheme2) => ({
  content: css({
    overflow: 'auto',

    code: {
      whiteSpace: 'normal',
      wordWrap: 'break-word',
    },

    'pre > code': {
      display: 'block',
    },
  }),
  cornerLinks: css({
    listStyle: 'none',
    paddingLeft: 0,
  }),
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 2,
      fill: theme.colors.text.maxContrast,
    }),
    iconLinks: css({
      left: theme.spacing(0.5),
      top: theme.spacing(0.25),
    }),
    inner: css({
      width: 0,
      height: 0,
      position: 'absolute',
      left: 0,
      bottom: 0,
      borderBottom: `${theme.spacing(4)} solid transparent`,
      borderLeft: `${theme.spacing(4)} solid ${theme.colors.background.secondary}`,
    }),
    error: css({
      borderLeftColor: theme.colors.error.main,
    }),
    infoCorner: css({
      background: 'none',
      border: 'none',
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      position: 'absolute',
      left: 0,
      top: 0,
      width: theme.spacing(4),
      height: theme.spacing(4),
      zIndex: 3,
    }),
  };
};
