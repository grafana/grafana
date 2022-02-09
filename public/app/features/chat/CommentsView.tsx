import React, { useLayoutEffect, useRef, useState } from 'react';
import { CustomScrollbar, TextArea } from '@grafana/ui';

import { Comment } from './Comment';
import { Message } from './types';

type Props = {
  comments: Message[];
  packetCounter: number;
  addComment: (comment: string) => Promise<boolean>;
};

export const CommentsView = ({ comments, packetCounter, addComment }: Props) => {
  const [comment, setComment] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const commentsViewContainer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (commentsViewContainer.current) {
      setScrollTop(commentsViewContainer.current.offsetHeight);
    } else {
      setScrollTop(0);
    }
  }, [packetCounter]);

  const onUpdateComment = (e: any) => {
    setComment(e.target.value);
  };

  const onKeyPress = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e?.key === 'Enter' && !e?.shiftKey) {
      e.preventDefault();

      if (comment.length > 0) {
        const result = await addComment(comment);
        if (result) {
          setComment('');
        }
      }
    }
  };

  return (
    <CustomScrollbar scrollTop={scrollTop}>
      <div ref={commentsViewContainer}>
        {comments.map((msg) => (
          <Comment key={msg.id} message={msg} />
        ))}
        <TextArea
          placeholder="Write a comment"
          value={comment}
          onChange={onUpdateComment}
          onKeyPress={onKeyPress}
          autoFocus={true}
        />
      </div>
    </CustomScrollbar>
  );
};
