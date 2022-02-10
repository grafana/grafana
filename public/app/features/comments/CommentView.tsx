import React, { FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { CustomScrollbar, TextArea } from '@grafana/ui';

import { Comment } from './Comment';
import { Message } from './types';

type Props = {
  comments: Message[];
  packetCounter: number;
  addComment: (comment: string) => Promise<boolean>;
};

export const CommentView = ({ comments, packetCounter, addComment }: Props) => {
  const [comment, setComment] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const commentViewContainer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (commentViewContainer.current) {
      setScrollTop(commentViewContainer.current.offsetHeight);
    } else {
      setScrollTop(0);
    }
  }, [packetCounter]);

  const onUpdateComment = (event: FormEvent<HTMLTextAreaElement>) => {
    const element = event.target as HTMLInputElement;
    setComment(element.value);
  };

  const onKeyPress = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event?.key === 'Enter' && !event?.shiftKey) {
      event.preventDefault();

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
      <div ref={commentViewContainer}>
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
