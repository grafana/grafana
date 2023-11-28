import React from 'react';
import { useStyles } from '@grafana/ui';
import { BucketBlock } from '../../BucketBlock';
import { DescriptionBlock } from '../../DescriptionBlock';
import { KeysBlock } from '../../KeysBlock';
import { isS3Location } from '../StorageLocations.utils';
import { getStyles } from './StorageLocationDetails.styles';
export const StorageLocationDetails = ({ location }) => {
    const { description } = location;
    const styles = useStyles(getStyles);
    return (React.createElement("div", { "data-testid": "storage-location-wrapper", className: styles.wrapper },
        React.createElement(DescriptionBlock, { description: description, dataTestId: "storage-location-description" }),
        isS3Location(location) ? (React.createElement(React.Fragment, null,
            React.createElement(BucketBlock, { bucketName: location.bucketName }),
            React.createElement(KeysBlock, { accessKey: location.accessKey, secretKey: location.secretKey }))) : null));
};
//# sourceMappingURL=StorageLocationDetails.js.map