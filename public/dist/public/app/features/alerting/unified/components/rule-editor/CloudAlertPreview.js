import { css } from '@emotion/css';
import React from 'react';
import { Icon, TagList, Tooltip, useStyles2 } from '@grafana/ui/src';
import { labelsToTags } from '../../utils/labels';
import { AlertStateTag } from '../rules/AlertStateTag';
import { mapDataFrameToAlertPreview } from './preview';
export function CloudAlertPreview({ preview }) {
    const styles = useStyles2(getStyles);
    const alertPreview = mapDataFrameToAlertPreview(preview);
    return (React.createElement("table", { className: styles.table },
        React.createElement("caption", null,
            React.createElement("div", null, "Alerts preview"),
            React.createElement("span", null, "Preview based on the result of running the query for this moment.")),
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "State"),
                React.createElement("th", null, "Labels"),
                React.createElement("th", null, "Info"))),
        React.createElement("tbody", null, alertPreview.instances.map(({ state, info, labels }, index) => {
            const instanceTags = labelsToTags(labels);
            return (React.createElement("tr", { key: index },
                React.createElement("td", null, React.createElement(AlertStateTag, { state: state })),
                React.createElement("td", null,
                    React.createElement(TagList, { tags: instanceTags, className: styles.tagList })),
                React.createElement("td", null, info && (React.createElement(Tooltip, { content: info },
                    React.createElement(Icon, { name: "info-circle" }))))));
        }))));
}
const getStyles = (theme) => ({
    table: css `
    width: 100%;
    margin: ${theme.spacing(2, 0)};

    caption {
      caption-side: top;
      color: ${theme.colors.text.primary};

      & > span {
        font-size: ${theme.typography.bodySmall.fontSize};
        color: ${theme.colors.text.secondary};
      }
    }

    td,
    th {
      padding: ${theme.spacing(1, 1)};
    }

    td + td,
    th + th {
      padding-left: ${theme.spacing(3)};
    }

    thead th {
      &:nth-child(1) {
        width: 80px;
      }

      &:nth-child(2) {
        width: auto;
      }

      &:nth-child(3) {
        width: 40px;
      }
    }

    td:nth-child(3) {
      text-align: center;
    }

    tbody tr:nth-child(2n + 1) {
      background-color: ${theme.colors.background.secondary};
    }
  `,
    tagList: css `
    justify-content: flex-start;
  `,
});
//# sourceMappingURL=CloudAlertPreview.js.map