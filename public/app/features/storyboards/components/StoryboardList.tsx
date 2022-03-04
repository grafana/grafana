import React, { FC } from 'react';
import { Button, Card, HorizontalGroup, Icon } from '@grafana/ui';
import { Storyboard } from '../types';

interface Props {
  boards: Storyboard[];
  onRemove: (boardId: string) => void;
}

export const StoryboardList: FC<Props> = ({ boards, onRemove }) => {
  if (!boards.length) {
    return <p>No Storyboards found. Start by creating one!</p>;
  }
  return (
    <HorizontalGroup wrap align="flex-start">
      {boards.map((board) => (
        <Card key={board.uid} heading={board.title} href={`storyboards/${board.uid}`}>
          <Card.Figure>
            <Icon name="book-open" />
          </Card.Figure>
          <Card.SecondaryActions>
            <Button
              variant="secondary"
              icon="trash-alt"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(board.uid);
              }}
            >
              Remove
            </Button>
          </Card.SecondaryActions>
        </Card>
      ))}
    </HorizontalGroup>
  );
};
