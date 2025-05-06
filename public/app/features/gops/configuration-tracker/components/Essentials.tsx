import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, Dropdown, Icon, LinkButton, Menu, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { RelativeUrl, createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { SectionDto, SectionDtoStep, SectionsDto, StepButtonDto } from '../irmHooks';

import { ProgressBar, StepsStatus } from './ProgressBar';

export interface EssentialsProps {
  onClose: () => void;
  essentialsConfig: SectionsDto;
  stepsDone: number;
  totalStepsToDo: number;
}

export function Essentials({ onClose, essentialsConfig, stepsDone, totalStepsToDo }: EssentialsProps) {
  return (
    <Drawer
      title={t('gops.essentials.title-essentials', 'Essentials')}
      subtitle="Complete the following configuration tasks"
      onClose={onClose}
    >
      <EssentialContent essentialContent={essentialsConfig} stepsDone={stepsDone} totalStepsToDo={totalStepsToDo} />
    </Drawer>
  );
}

export function EssentialContent({
  essentialContent,
  stepsDone,
  totalStepsToDo,
}: {
  essentialContent: SectionsDto;
  stepsDone: number;
  totalStepsToDo: number;
}) {
  return (
    <Stack direction={'column'} gap={1}>
      <ProgressStatus stepsDone={stepsDone} totalStepsToDo={totalStepsToDo} />
      {essentialContent.sections.map((section: SectionDto) => (
        <Section key={section.title} section={section} />
      ))}
    </Stack>
  );
}
interface SectionProps {
  section: SectionDto;
}
function Section({ section }: SectionProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Text element="h4">
        <span className="fs-unmask">{section.title}</span>
      </Text>

      <Text color="secondary">
        <span className="fs-unmask">{section.description}</span>
      </Text>
      <Stack direction={'column'} gap={2}>
        {section.steps.map((step, index) => (
          <Step key={index} step={step} />
        ))}
      </Stack>
    </div>
  );
}
function DoneIcon({ done }: { done: boolean }) {
  return done ? (
    <Icon name="check-circle" color="green" data-testid="checked-step" className="fs-unmask" />
  ) : (
    <Icon name="circle" data-testid="unckecked-step" className="fs-unmask" />
  );
}
interface StepProps {
  step: SectionDtoStep;
}

function Step({ step }: StepProps) {
  return (
    <Stack direction={'row'} justifyContent={'space-between'} data-testid="step">
      <Stack direction={'row'} alignItems="center">
        {step.done !== undefined && <DoneIcon done={step.done} />}
        <Text variant="body">
          <span className="fs-unmask">{step.title}</span>
        </Text>
        <Tooltip content={step.description} placement="right">
          <Icon name="question-circle" />
        </Tooltip>
      </Stack>
      <StepButton {...step.button} done={step.done} data-testid="step-button" />
    </Stack>
  );
}

interface LinkButtonProps {
  urlLink?: { url: RelativeUrl; queryParams?: Record<string, string> };
  label: string;
  urlLinkOnDone?: { url: RelativeUrl; queryParams?: Record<string, string> };
  labelOnDone?: string;
  done?: boolean;
}
function OpenLinkButton(props: LinkButtonProps) {
  const { urlLink, label, urlLinkOnDone, labelOnDone, done } = props;
  const urlToGoWhenNotDone = urlLink?.url
    ? createRelativeUrl(urlLink.url, {
        returnTo: location.pathname + location.search,
        ...urlLink.queryParams,
      })
    : '';
  const urlToGoWhenDone = urlLinkOnDone?.url
    ? createRelativeUrl(urlLinkOnDone.url, {
        returnTo: location.pathname + location.search,
        ...urlLinkOnDone.queryParams,
      })
    : '';
  const urlToGo = done ? urlToGoWhenDone : urlToGoWhenNotDone;
  return (
    <LinkButton href={urlToGo} variant="secondary" className="fs-unmask">
      {done ? (labelOnDone ?? label) : label}
    </LinkButton>
  );
}

interface StepButtonProps extends StepButtonDto {
  done?: boolean;
}
function StepButton({
  type,
  urlLink,
  urlLinkOnDone,
  label,
  labelOnDone,
  options,
  onClickOption,
  done,
  stepNotAvailableText,
}: StepButtonProps) {
  switch (type) {
    case 'openLink':
      return (
        <OpenLinkButton
          urlLink={urlLink}
          label={label}
          urlLinkOnDone={urlLinkOnDone}
          labelOnDone={labelOnDone}
          done={done}
        />
      );
    case 'dropDown':
      if (Boolean(options?.length)) {
        return (
          <Dropdown
            overlay={
              <Menu className="fs-unmask">
                {options?.map((option) => (
                  <Menu.Item
                    label={option.label}
                    key={option.value}
                    className="fs-unmask"
                    onClick={() => {
                      onClickOption?.(option.value);
                    }}
                  />
                ))}
              </Menu>
            }
          >
            <Button variant="secondary" size="md" className="fs-unmask">
              {label}
              <Icon name="angle-down" />
            </Button>
          </Dropdown>
        );
      } else {
        return <Text>{stepNotAvailableText ?? 'No options available'} </Text>;
      }
  }
}

function ProgressStatus({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  return (
    <Stack direction={'row'} gap={1} alignItems="center">
      <Trans i18nKey="gops.progress-status.your-progress">Your progress</Trans>
      <ProgressBar stepsDone={stepsDone} totalStepsToDo={totalStepsToDo} />
      <StepsStatus stepsDone={stepsDone} totalStepsToDo={totalStepsToDo} />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      margin: theme.spacing(2, 0),
      padding: theme.spacing(2),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
};
