import { render, screen } from '@testing-library/react';
import React from 'react';
import { BucketBlock } from './BucketBlock';
describe('BucketBlock', () => {
    it('should render', () => {
        render(React.createElement(BucketBlock, { bucketName: "bucket" }));
        expect(screen.getByTestId('storage-location-bucket')).toBeInTheDocument();
    });
});
//# sourceMappingURL=BucketBlock.test.js.map