import React from 'react';

import { TutorialItem } from 'app/features/tutorial/tutorialpage/TutorialItem';
import type { Tutorial } from 'app/features/tutorial/types';

type TutorialListProps = {
  author: Tutorial['author'];
  onPreview: (tutorial: Tutorial) => void;
  tutorials: Tutorial[];
};

export const TutorialList = ({ author, onPreview, tutorials }: TutorialListProps) => {
  return (
    <div>
      <h2>{author}</h2>
      <div>
        {tutorials.map((tutorial) => {
          return <TutorialItem key={tutorial.id} onPreview={onPreview} tutorial={tutorial} />;
        })}
      </div>
    </div>
  );
};
