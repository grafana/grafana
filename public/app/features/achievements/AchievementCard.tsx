import { css } from '@emotion/css';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box } from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, LinkButton, useStyles2, useTheme2 } from '@grafana/ui';

import { getAchievements } from './AchievementsService';
import { AchievementLevel } from './types';

interface AchievementCardProps {
  title: string;
  progress?: number;
  level?: AchievementLevel;
}

export const AchievementCard = ({ title, progress = 20, level }: AchievementCardProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  let achievementsListState = useAsync(async () => {
    return await getAchievements();
  }, []);

  const achievementsListByLevel =
    achievementsListState && achievementsListState.value?.filter((achievement) => achievement.level === level);

  return (
    <div className={styles.wrapper}>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
          sx={{ backgroundColor: theme.colors.background.secondary }}
        >
          <Box className={styles.progressBox}>
            <CircularProgress variant="determinate" value={progress} sx={{ color: '#F55F3E' }} />
            <Box className={styles.progressText}>{`${Math.round(progress)}%`}</Box>
          </Box>
          <h4 style={{ color: theme.colors.text.primary }}>{title}</h4>
        </AccordionSummary>
        <AccordionDetails sx={{ backgroundColor: theme.colors.background.primary }}>
          {achievementsListByLevel?.map((achievement, index) => {
            return (
              <Card key={index} id={achievement.id}>
                <Card.Figure>
                  {achievement.completed ? (
                    <Icon name={'check-circle'} aria-label={'check-circle'} className={styles.achievementIcon} />
                  ) : (
                    <Icon name={'grafana'} aria-label={'grafana'} className={styles.achievementIcon} />
                  )}
                </Card.Figure>
                <Card.Heading>{achievement.title}</Card.Heading>
                <Card.Description>{achievement.description}</Card.Description>
                <Card.Actions>
                  {achievement.video && (
                    <iframe
                      width="250"
                      height="131"
                      src={achievement.video}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    ></iframe>
                  )}
                </Card.Actions>
                <Card.SecondaryActions>
                  {achievement.link && (
                    <LinkButton
                      href={achievement.link}
                      icon="external-link-alt"
                      target="_blank"
                      size="sm"
                      variant="secondary"
                    >
                      Learn more
                    </LinkButton>
                  )}
                </Card.SecondaryActions>
              </Card>
            );
          })}
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    padding: '1px',
  }),
  progressText: css({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    fontSize: 10,
  }),
  icon: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: '5px',
  }),
  achievementIcon: css({
    color: '#F55F3E',
    height: '20px',
    width: '20px',
  }),
  progressBox: css({
    position: 'relative',
    display: 'inline-flex',
    marginRight: '10px',
  }),
});
