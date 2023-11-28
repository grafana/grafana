import { render, screen } from '@testing-library/react';
import React from 'react';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { KeysBlock } from './KeysBlock';
import { Messages } from './KeysBlock.messages';
jest.mock('app/percona/shared/components/Elements/SecretToggler', () => ({
    SecretToggler: jest.fn(() => React.createElement("div", { "data-testid": "secretToggler" })),
}));
describe('KeysBlock', () => {
    it('should have access key next to label', () => {
        render(React.createElement(KeysBlock, { accessKey: "access", secretKey: "secret" }));
        expect(screen.getByTestId('access-key')).toHaveTextContent(`${Messages.accessKey}access`);
    });
    it('should have SecretToggler with secret passed', () => {
        render(React.createElement(KeysBlock, { accessKey: "access", secretKey: "secret" }));
        expect(SecretToggler).toHaveBeenCalledWith(expect.objectContaining({ secret: 'secret' }), expect.anything());
    });
});
//# sourceMappingURL=KeysBlock.test.js.map