import { getJobMessages } from './getJobMessage';

describe('getJobMessages', () => {
  it('prefers job-level errors and warnings', () => {
    const result = getJobMessages(
      {
        state: 'error',
        errors: ['job error'],
        warnings: ['job warning'],
        summary: [
          { resourceErrors: [{ message: 'resource error' }], resourceWarnings: [{ message: 'resource warning' }] },
        ],
      },
      { includeResourceIssues: true }
    );

    expect(result).toEqual({ error: ['job error'], warning: ['job warning'] });
  });

  it('reads resourceErrors/resourceWarnings from the summary when the job has none', () => {
    const result = getJobMessages(
      {
        state: 'error',
        message: 'generic failure',
        summary: [
          {
            resourceErrors: [{ path: 'a.json', message: 'bad file' }],
            resourceWarnings: [{ message: 'careful' }],
          },
        ],
      },
      { includeResourceIssues: true }
    );

    expect(result).toEqual({ error: ['a.json: bad file'], warning: ['careful'] });
  });

  it('falls back to the deprecated summary strings when resource issues are absent', () => {
    const result = getJobMessages(
      { state: 'error', summary: [{ errors: ['legacy error'], warnings: ['legacy warning'] }] },
      { includeResourceIssues: true }
    );

    expect(result).toEqual({ error: ['legacy error'], warning: ['legacy warning'] });
  });

  it('ignores the summary unless includeResourceIssues is set', () => {
    const result = getJobMessages({
      state: 'error',
      message: 'generic failure',
      summary: [{ resourceErrors: [{ message: 'resource error' }] }],
    });

    expect(result).toEqual({ error: ['generic failure'] });
  });
});
