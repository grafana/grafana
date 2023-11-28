import React from 'react';
import { useStyles } from '@grafana/ui';
import { Messages } from './BucketBlock.messages';
import { getStyles } from './BucketBlock.styles';
export const BucketBlock = ({ bucketName }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.wrapper, "data-testid": "storage-location-bucket" },
        React.createElement("span", { className: styles.nameSpan }, Messages.bucketName),
        React.createElement("span", null, bucketName)));
};
//# sourceMappingURL=BucketBlock.js.map