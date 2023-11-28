import { css } from '@emotion/css';
import React from 'react';
import { dateMath, intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import SilencedAlertsTable from './SilencedAlertsTable';
export const SilenceDetails = ({ silence }) => {
    const { startsAt, endsAt, comment, createdBy, silencedAlerts } = silence;
    const styles = useStyles2(getStyles);
    const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
    const startsAtDate = dateMath.parse(startsAt);
    const endsAtDate = dateMath.parse(endsAt);
    const duration = intervalToAbbreviatedDurationString({ start: new Date(startsAt), end: new Date(endsAt) });
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.title }, "Comment"),
        React.createElement("div", null, comment),
        React.createElement("div", { className: styles.title }, "Schedule"),
        React.createElement("div", null, `${startsAtDate === null || startsAtDate === void 0 ? void 0 : startsAtDate.format(dateDisplayFormat)} - ${endsAtDate === null || endsAtDate === void 0 ? void 0 : endsAtDate.format(dateDisplayFormat)}`),
        React.createElement("div", { className: styles.title }, "Duration"),
        React.createElement("div", null,
            " ",
            duration),
        React.createElement("div", { className: styles.title }, "Created by"),
        React.createElement("div", null,
            " ",
            createdBy),
        React.createElement("div", { className: styles.title }, "Affected alerts"),
        React.createElement(SilencedAlertsTable, { silencedAlerts: silencedAlerts })));
};
const getStyles = (theme) => ({
    container: css `
    display: grid;
    grid-template-columns: 1fr 9fr;
    grid-row-gap: 1rem;
  `,
    title: css `
    color: ${theme.colors.text.primary};
  `,
    row: css `
    margin: ${theme.spacing(1, 0)};
  `,
});
//# sourceMappingURL=SilenceDetails.js.map