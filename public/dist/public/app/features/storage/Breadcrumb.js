import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
export function Breadcrumb({ pathName, onPathChange, rootIcon }) {
    const styles = useStyles2(getStyles);
    const paths = pathName.split('/').filter(Boolean);
    return (React.createElement("ul", { className: styles.breadCrumb },
        rootIcon && (React.createElement("li", null,
            React.createElement(Icon, { name: rootIcon, onClick: () => onPathChange('') }))),
        paths.map((path, index) => {
            let url = '/' + paths.slice(0, index + 1).join('/');
            const onClickBreadcrumb = () => onPathChange(url);
            const isLastBreadcrumb = index === paths.length - 1;
            return (
            // TODO: fix keyboard a11y
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            React.createElement("li", { key: uniqueId(path), onClick: isLastBreadcrumb ? undefined : onClickBreadcrumb }, path));
        })));
}
function getStyles(theme) {
    return {
        breadCrumb: css `
      list-style: none;
      padding: ${theme.spacing(2, 1)};

      li {
        display: inline;

        :not(:last-child) {
          color: ${theme.colors.text.link};
          cursor: pointer;
        }
        + li:before {
          content: '>';
          padding: ${theme.spacing(1)};
          color: ${theme.colors.text.secondary};
        }
      }
    `,
    };
}
//# sourceMappingURL=Breadcrumb.js.map