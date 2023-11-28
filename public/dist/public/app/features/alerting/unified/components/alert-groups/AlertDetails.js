import { css } from '@emotion/css';
import React from 'react';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { AlertmanagerAction } from '../../hooks/useAbilities';
import { isGrafanaRulesSource } from '../../utils/datasource';
import { makeAMLink, makeLabelBasedSilenceLink } from '../../utils/misc';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { Authorize } from '../Authorize';
export const AlertDetails = ({ alert, alertManagerSourceName }) => {
    const styles = useStyles2(getStyles);
    // For Grafana Managed alerts the Generator URL redirects to the alert rule edit page, so update permission is required
    // For external alert manager the Generator URL redirects to an external service which we don't control
    const isGrafanaSource = isGrafanaRulesSource(alertManagerSourceName);
    const isSeeSourceButtonEnabled = isGrafanaSource
        ? contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)
        : true;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.actionsRow },
            alert.status.state === AlertState.Suppressed && (React.createElement(Authorize, { actions: [AlertmanagerAction.CreateSilence, AlertmanagerAction.UpdateSilence] },
                React.createElement(LinkButton, { href: `${makeAMLink('/alerting/silences', alertManagerSourceName)}&silenceIds=${alert.status.silencedBy.join(',')}`, className: styles.button, icon: 'bell', size: 'sm' }, "Manage silences"))),
            alert.status.state === AlertState.Active && (React.createElement(Authorize, { actions: [AlertmanagerAction.CreateSilence] },
                React.createElement(LinkButton, { href: makeLabelBasedSilenceLink(alertManagerSourceName, alert.labels), className: styles.button, icon: 'bell-slash', size: 'sm' }, "Silence"))),
            isSeeSourceButtonEnabled && alert.generatorURL && (React.createElement(LinkButton, { className: styles.button, href: alert.generatorURL, icon: 'chart-line', size: 'sm' }, "See source"))),
        Object.entries(alert.annotations).map(([annotationKey, annotationValue]) => (React.createElement(AnnotationDetailsField, { key: annotationKey, annotationKey: annotationKey, value: annotationValue }))),
        React.createElement("div", { className: styles.receivers },
            "Receivers:",
            ' ',
            alert.receivers
                .map(({ name }) => name)
                .filter((name) => !!name)
                .join(', '))));
};
const getStyles = (theme) => ({
    button: css `
    & + & {
      margin-left: ${theme.spacing(1)};
    }
  `,
    actionsRow: css `
    padding: ${theme.spacing(2, 0)} !important;
    border-bottom: 1px solid ${theme.colors.border.medium};
  `,
    receivers: css `
    padding: ${theme.spacing(1, 0)};
  `,
});
//# sourceMappingURL=AlertDetails.js.map