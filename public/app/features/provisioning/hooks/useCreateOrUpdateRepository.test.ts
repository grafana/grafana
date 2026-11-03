import { renderHook } from '@testing-library/react';

import {
  handleProvisioningFormError,
  type RepositorySpec,
  useCreateRepositoryMutation,
  useCreateRepositoryTestMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';

import { useCreateOrUpdateRepository } from './useCreateOrUpdateRepository';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  handleProvisioningFormError: jest.fn(),
  useCreateRepositoryMutation: jest.fn(),
  useCreateRepositoryTestMutation: jest.fn(),
  useReplaceRepositoryMutation: jest.fn(),
}));

const mockDispatch = jest.fn();
jest.mock('app/types/store', () => ({
  useDispatch: () => mockDispatch,
}));

const mockCreate = jest.fn();
const mockTest = jest.fn();

const gitSpec = (url: string): RepositorySpec => ({
  title: 'My Repo',
  type: 'git',
  sync: { enabled: false, target: 'folder' },
  workflows: ['write'],
  git: { url, branch: 'main' },
});

const testResult = (fn: () => Promise<unknown>) => ({ unwrap: fn });

function submit(spec: RepositorySpec) {
  const { result } = renderHook(() => useCreateOrUpdateRepository());
  return result.current[0](spec);
}

describe('useCreateOrUpdateRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useCreateRepositoryMutation).mockReturnValue([mockCreate, {}] as never);
    jest.mocked(useReplaceRepositoryMutation).mockReturnValue([jest.fn(), {}] as never);
    jest.mocked(useCreateRepositoryTestMutation).mockReturnValue([mockTest, {}] as never);
  });

  it('retries the test with a .git suffix and saves that URL when the first test fails', async () => {
    mockTest
      .mockReturnValueOnce(testResult(() => Promise.reject(new Error('not found'))))
      .mockReturnValueOnce(testResult(() => Promise.resolve({ success: true })));

    await submit(gitSpec('https://git.example.com/owner/repo/'));

    expect(mockTest).toHaveBeenCalledTimes(2);
    expect(mockTest.mock.calls[1][0].body.spec.git.url).toBe('https://git.example.com/owner/repo.git');
    expect(mockCreate.mock.calls[0][0].repository.spec.git.url).toBe('https://git.example.com/owner/repo.git');
    expect(handleProvisioningFormError).not.toHaveBeenCalled();
  });

  it('throws the original error when the retry with a .git suffix also fails', async () => {
    const original = new Error('original');
    mockTest
      .mockReturnValueOnce(testResult(() => Promise.reject(original)))
      .mockReturnValueOnce(testResult(() => Promise.reject(new Error('retry'))));

    await expect(submit(gitSpec('https://git.example.com/owner/repo'))).rejects.toBe(original);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(handleProvisioningFormError).toHaveBeenCalledTimes(1);
    expect(handleProvisioningFormError).toHaveBeenCalledWith(
      { error: original },
      mockDispatch,
      'Error validating repository'
    );
  });

  it('does not retry when the URL already ends with .git', async () => {
    mockTest.mockReturnValueOnce(testResult(() => Promise.reject(new Error('not found'))));

    await expect(submit(gitSpec('https://git.example.com/owner/repo.git'))).rejects.toThrow('not found');
    expect(mockTest).toHaveBeenCalledTimes(1);
    expect(handleProvisioningFormError).toHaveBeenCalledTimes(1);
  });

  it('does not retry for other repository types', async () => {
    mockTest.mockReturnValueOnce(testResult(() => Promise.reject(new Error('not found'))));

    await expect(
      submit({ ...gitSpec('https://github.com/owner/repo'), type: 'github', git: undefined })
    ).rejects.toThrow('not found');
    expect(mockTest).toHaveBeenCalledTimes(1);
  });
});
