import { render, screen } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { S3Fields } from './S3Fields';
jest.mock('app/percona/shared/components/Elements/SecretToggler', () => ({
    SecretToggler: jest.fn(({ children }) => React.createElement("div", { "data-testid": "secret-toggler" }, children)),
}));
describe('S3Fields', () => {
    it('should pass initial values', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(S3Fields, { bucketName: "bucket", endpoint: "/foo", accessKey: "accessKey", secretKey: "secretKey" }) }));
        const inputs = screen.getAllByRole('textbox').filter((item) => item.tagName === 'INPUT');
        expect(inputs.find((item) => item.value === '/foo')).toBeTruthy();
        expect(inputs.find((item) => item.value === 'accessKey')).toBeTruthy();
        expect(inputs.find((item) => item.value === 'bucket')).toBeTruthy();
        expect(SecretToggler).toHaveBeenCalledWith(expect.objectContaining({ secret: 'secretKey' }), expect.anything());
    });
});
//# sourceMappingURL=S3Fields.test.js.map