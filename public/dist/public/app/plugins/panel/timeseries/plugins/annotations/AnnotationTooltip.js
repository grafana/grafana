import { css } from '@emotion/css';
import React from 'react';
import { textUtil } from '@grafana/data';
import { HorizontalGroup, IconButton, Tag, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';
export const AnnotationTooltip = ({ annotation, timeFormatter, canEdit, canDelete, onEdit, onDelete, }) => {
    const styles = useStyles2(getStyles);
    const time = timeFormatter(annotation.time);
    const timeEnd = timeFormatter(annotation.timeEnd);
    let text = annotation.text;
    const tags = annotation.tags;
    let alertText = '';
    let avatar;
    let editControls;
    let state = null;
    const ts = React.createElement("span", { className: styles.time }, Boolean(annotation.isRegion) ? `${time} - ${timeEnd}` : time);
    if (annotation.login && annotation.avatarUrl) {
        avatar = React.createElement("img", { className: styles.avatar, alt: "Annotation avatar", src: annotation.avatarUrl });
    }
    if (annotation.alertId !== undefined && annotation.newState) {
        const stateModel = alertDef.getStateDisplayModel(annotation.newState);
        state = (React.createElement("div", { className: styles.alertState },
            React.createElement("i", { className: stateModel.stateClass }, stateModel.text)));
        alertText = alertDef.getAlertAnnotationInfo(annotation);
    }
    else if (annotation.title) {
        text = annotation.title + '<br />' + (typeof text === 'string' ? text : '');
    }
    if (canEdit || canDelete) {
        editControls = (React.createElement("div", { className: styles.editControls },
            canEdit && React.createElement(IconButton, { name: 'pen', size: 'sm', onClick: onEdit, tooltip: "Edit" }),
            canDelete && React.createElement(IconButton, { name: 'trash-alt', size: 'sm', onClick: onDelete, tooltip: "Delete" })));
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.header },
            React.createElement(HorizontalGroup, { justify: 'space-between', align: 'center', spacing: 'md' },
                React.createElement("div", { className: styles.meta },
                    React.createElement("span", null,
                        avatar,
                        state),
                    ts),
                editControls)),
        React.createElement("div", { className: styles.body },
            text && React.createElement("div", { dangerouslySetInnerHTML: { __html: textUtil.sanitize(text) } }),
            alertText,
            React.createElement(React.Fragment, null,
                React.createElement(HorizontalGroup, { spacing: "xs", wrap: true }, tags === null || tags === void 0 ? void 0 : tags.map((t, i) => React.createElement(Tag, { name: t, key: `${t}-${i}` })))))));
};
AnnotationTooltip.displayName = 'AnnotationTooltip';
const getStyles = (theme) => {
    return {
        wrapper: css `
      max-width: 400px;
    `,
        commentWrapper: css `
      margin-top: 10px;
      border-top: 2px solid #2d2b34;
      height: 30vh;
      overflow-y: scroll;
      padding: 0 3px;
    `,
        header: css `
      padding: ${theme.spacing(0.5, 1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      font-size: ${theme.typography.bodySmall.fontSize};
      display: flex;
    `,
        meta: css `
      display: flex;
      justify-content: space-between;
    `,
        editControls: css `
      display: flex;
      align-items: center;
      > :last-child {
        margin-right: 0;
      }
    `,
        avatar: css `
      border-radius: ${theme.shape.radius.circle};
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing(1)};
    `,
        alertState: css `
      padding-right: ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
        time: css `
      color: ${theme.colors.text.secondary};
      font-weight: normal;
      display: inline-block;
      position: relative;
      top: 1px;
    `,
        body: css `
      padding: ${theme.spacing(1)};

      a {
        color: ${theme.colors.text.link};
        &:hover {
          text-decoration: underline;
        }
      }
    `,
    };
};
//# sourceMappingURL=AnnotationTooltip.js.map