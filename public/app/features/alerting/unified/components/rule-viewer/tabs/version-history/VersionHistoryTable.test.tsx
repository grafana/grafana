import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { computeVersionDiff } from 'app/features/alerting/unified/utils/diff';

import { mockRulerGrafanaRule } from '../../../../mocks';

import { VersionHistoryTable } from './VersionHistoryTable';

jest.mock('app/features/alerting/unified/utils/diff');
jest.mock('./ConfirmVersionRestoreModal', () => ({
  ConfirmVersionRestoreModal: () => null,
}));

describe('VersionHistoryTable', () => {
  it('compares versions across a page boundary', async () => {
    const ruleVersions = Array.from({ length: 22 }, (_, index) =>
      mockRulerGrafanaRule({}, { uid: `rule-${index}`, version: 22 - index })
    );
    const computeVersionDiffMock = jest.mocked(computeVersionDiff);
    computeVersionDiffMock.mockReturnValue({ added: 0, removed: 0 });
    const user = userEvent.setup();

    render(
      <VersionHistoryTable
        ruleVersions={ruleVersions}
        checkedVersions={new Set()}
        disableSelection={false}
        canRestore={false}
        onVersionsChecked={jest.fn()}
        onCompareSingleVersion={jest.fn()}
        onRestoreSuccess={jest.fn()}
        onRestoreError={jest.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: /next/i }));

    expect(computeVersionDiffMock).toHaveBeenCalledWith(ruleVersions[21], ruleVersions[20]);
  });
});
