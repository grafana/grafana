import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, Field, Icon, Input, Label, Modal, Spinner, Stack, TextArea } from '@grafana/ui';
import {
  useCreateRepositoryPrMutation,
  useGetRepositoryDiffQuery,
  useGetRepositoryFilesWithPathQuery,
  useGetRepositoryRefsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { GenAIButton } from 'app/features/dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from 'app/features/dashboard/components/GenAI/tracking';
import { Message, Role } from 'app/features/dashboard/components/GenAI/utils';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { DashboardRoutes } from 'app/types';

interface CommonBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  path?: string;
  slug?: string;
}

interface DashboardPreviewBannerProps extends CommonBannerProps {
  route?: string;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {}

const commonAlertProps = {
  severity: 'info' as const,
  style: { flex: 0 } as const,
};

interface GitHubPRForm {
  title: string;
  description: string;
  baseBranch: string;
}

const CreatePullRequestModal = ({
  slug,
  branch,
  isOpen,
  onDismiss,
}: {
  slug: string;
  branch: string;
  isOpen: boolean;
  onDismiss: () => void;
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GitHubPRForm>();

  const baseBranch = watch('baseBranch') ?? 'master';

  const { data: diffData, isLoading: isDiffLoading } = useGetRepositoryDiffQuery(
    {
      name: slug,
      ref: branch,
      base: baseBranch,
    },
    {
      skip: !isOpen || !baseBranch,
    }
  );

  const { data: branches, isLoading: isBranchesLoading } = useGetRepositoryRefsQuery({ name: slug });

  useEffect(() => {
    if (branches) {
      setValue('baseBranch', branches.items[0]?.name);
    }
  }, [branches, setValue]);

  const [
    createPullRequest,
    { isLoading: isCreatingPullRequest, isSuccess: isCreatePullRequestSuccess, data: createPullRequestData },
  ] = useCreateRepositoryPrMutation();

  const onSubmit = async (data: GitHubPRForm) => {
    createPullRequest({
      name: slug,
      ref: branch,
      title: data.title,
      content: data.description,
    });
  };

  const titleMessage: Message[] = [
    {
      role: Role.system,
      content: `You are an expert in creating pull request in Github and titles for them.
  Your goal is to write a short but descriptive title for a pull request.
  The title should explain the purpose of the pull request.
  It should be between 10-30 characters and be helpful for users to understand the pull request's value.
  Do not include quotes in your response.
  The response should contain ONLY the proposed title, no other text.
  `,
    },
    {
      role: Role.user,
      content: `Create a title for a pull request."
  These are the changes between the current branch and the master branch: ${JSON.stringify(diffData?.diff?.files)}
  These are the commits of the current branch:
  ${JSON.stringify(diffData?.diff?.commits)}
  `,
    },
  ];

  const descriptionMessage: Message[] = [
    {
      role: Role.system,
      content: `You are an expert in creating pull request in Github and descriptions for them.
  Your goal is to write a descriptive and informative pull request description.
  The description should explain the purpose of the pull request.
  The response should contain ONLY the proposed description, no other text.
  `,
    },
    {
      role: Role.user,
      content: `Create a description for a pull request"
These are the changes between the current branch and the master branch: ${JSON.stringify(diffData?.diff?.files)}
These are the commits of the current branch:
${JSON.stringify(diffData?.diff?.commits)}
`,
    },
  ];

  return (
    <Modal
      isOpen
      title={t('dashboard-scene.dashboard-preview-banner.create-pull-request', 'Create pull request')}
      onDismiss={onDismiss}
    >
      {isCreatePullRequestSuccess ? (
        <Alert
          severity="success"
          title={t(
            'dashboard-scene.dashboard-preview-banner.pull-request-created',
            'Pull request successfully created'
          )}
          buttonContent={
            <Stack alignItems="center">
              <Trans i18nKey="dashboard-scene.dashboard-preview-banner.view-pull-request-in-git-hub">
                View pull request in GitHub
              </Trans>
              <Icon name="external-link-alt" />
            </Stack>
          }
          onRemove={() => window.open(createPullRequestData?.pullRequest?.url, '_blank')}
        />
      ) : (
        <fieldset disabled={isCreatingPullRequest}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                invalid={!!errors.title}
                error={errors.title?.message}
                label={
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Label>{t('dashboard-scene.dashboard-preview-banner.title', 'Title')}</Label>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      {isDiffLoading && <Spinner />}
                      <GenAIButton
                        tooltip={t(
                          'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-path',
                          'AI autofill path'
                        )}
                        messages={titleMessage}
                        disabled={isDiffLoading}
                        onGenerate={(response) => setValue('title', response, { shouldDirty: true })}
                        eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                      />
                    </Stack>
                  </Stack>
                }
              >
                <Input
                  {...register('title', {
                    required: t('dashboard-scene.dashboard-preview-banner.title-required', 'Title is required'),
                  })}
                />
              </Field>
              <Field
                noMargin
                invalid={!!errors.description}
                error={errors.description?.message}
                label={
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Label>{t('dashboard-scene.dashboard-preview-banner.description', 'Description')}</Label>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      {isDiffLoading && <Spinner />}
                      <GenAIButton
                        tooltip={t(
                          'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-path',
                          'AI autofill path'
                        )}
                        messages={descriptionMessage}
                        disabled={isDiffLoading}
                        onGenerate={(response) => setValue('description', response, { shouldDirty: true })}
                        eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                      />
                    </Stack>
                  </Stack>
                }
              >
                <TextArea
                  {...register('description', {
                    required: t(
                      'dashboard-scene.dashboard-preview-banner.description-required',
                      'Description is required'
                    ),
                  })}
                  rows={10}
                />
              </Field>
              {/* <Field label={t('dashboard-scene.dashboard-preview-banner.base-branch', 'Base branch')}>
                <Controller
                  name={'baseBranch'}
                  control={control}
                  render={({ field: { ref, onChange, ...field } }) => {
                    return (
                      <Combobox
                        {...field}
                        loading={isBranchesLoading}
                        options={branches?.items?.map((branch) => ({ label: branch.name, value: branch.name })) ?? []}
                        onChange={(value) => onChange(value?.value)}
                        placeholder={t(
                          'dashboard-scene.dashboard-preview-banner.placeholder-select-branch',
                          'Select branch'
                        )}
                      />
                    );
                  }}
                />
              </Field> */}
              <Modal.ButtonRow>
                <Button variant="secondary" fill="outline" onClick={onDismiss}>
                  {t('dashboard-scene.dashboard-preview-banner.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  icon={isCreatingPullRequest ? 'spinner' : undefined}
                  disabled={isBranchesLoading}
                >
                  {isCreatingPullRequest
                    ? t('dashboard-scene.dashboard-preview-banner.creating-pull-request', 'Creating pull request')
                    : t('dashboard-scene.dashboard-preview-banner.create-pull-request', 'Create pull request')}
                </Button>
              </Modal.ButtonRow>
            </Stack>
          </form>
        </fieldset>
      )}
    </Modal>
  );
};

function DashboardPreviewBannerContent({ queryParams, slug, path }: DashboardPreviewBannerContentProps) {
  const prParam = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const [showPRModal, setShowPRModal] = useState(false);

  if (file.data?.errors) {
    return (
      <Alert
        title={t('dashboard-scene.dashboard-preview-banner.title-error-loading-dashboard', 'Error loading dashboard')}
        severity="error"
        style={{ flex: 0 }}
      >
        {file.data.errors.map((error, index) => (
          <div key={index}>{error}</div>
        ))}
      </Alert>
    );
  }

  // This page was loaded with a `pull_request_url` in the URL
  if (prParam?.length) {
    return (
      <Alert
        {...commonAlertProps}
        title={t(
          'dashboard-scene.dashboard-preview-banner.title-dashboard-loaded-request-git-hub',
          'This dashboard is loaded from a pull request in GitHub.'
        )}
        buttonContent={
          <Stack alignItems="center">
            <Trans i18nKey="dashboard-scene.dashboard-preview-banner.view-pull-request-in-git-hub">
              View pull request in GitHub
            </Trans>
            <Icon name="external-link-alt" />
          </Stack>
        }
        onRemove={() => window.open(textUtil.sanitizeUrl(prParam), '_blank')}
      >
        <Trans i18nKey="dashboard-scene.dashboard-preview-banner.value-not-saved">
          The value is not yet saved in the Grafana database
        </Trans>
      </Alert>
    );
  }

  // Check if this is a GitHub link
  const githubURL = file.data?.urls?.newPullRequestURL ?? file.data?.urls?.compareURL;

  if (githubURL) {
    return (
      <>
        <Alert
          {...commonAlertProps}
          title={t(
            'dashboard-scene.dashboard-preview-banner.title-dashboard-loaded-branch-git-hub',
            'This dashboard is loaded from a branch in GitHub.'
          )}
          buttonContent={
            <Trans i18nKey="dashboard-scene.dashboard-preview-banner.create-pull-request-in-git-hub">
              Create pull request
            </Trans>
          }
          onRemove={() => setShowPRModal(true)}
        >
          <Trans i18nKey="dashboard-scene.dashboard-preview-banner.not-saved">
            The value is not yet saved in the Grafana database
          </Trans>
        </Alert>
        {showPRModal && (
          <CreatePullRequestModal
            slug={slug}
            branch={queryParams.ref ?? 'master'}
            isOpen={showPRModal}
            onDismiss={() => setShowPRModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <Alert
      {...commonAlertProps}
      title={t(
        'dashboard-scene.dashboard-preview-banner.title-dashboard-loaded-external-repository',
        'This dashboard is loaded from an external repository'
      )}
    >
      <Trans i18nKey="dashboard-scene.dashboard-preview-banner.not-yet-saved">
        The value is not saved in the Grafana database
      </Trans>
    </Alert>
  );
}

export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  const provisioningEnabled = config.featureToggles.provisioning;
  if (!provisioningEnabled || 'kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return <DashboardPreviewBannerContent queryParams={queryParams} slug={slug} path={path} />;
}
