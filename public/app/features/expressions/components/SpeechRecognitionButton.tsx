import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { Button } from '@grafana/ui';

interface SpeechRecognitionProps {
  onResult: (result: string) => void;
  debug?: boolean;
  className?: string;
}

export const SpeechRecognitionButton: React.FC<SpeechRecognitionProps> = ({ onResult, debug, className }) => {
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionConstructor) {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setTranscript(transcript);
        onResult(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    } else {
      console.log('Speech recognition not supported on this browser :(');
    }
  }, [onResult]);

  const startListening = () => {
    if (recognition) {
      setIsListening(true);
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition) {
      setIsListening(false);
      recognition.stop();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!recognition) {
    return null; // Speech recognition not supported
  }

  return (
    <div className={className || styles.container}>
      {debug && <span>{transcript}</span>}
      <Button icon="record-audio" onClick={toggleListening} variant={isListening ? 'destructive' : 'primary'}>
        {isListening ? 'Stop listening' : 'Ask your question'}
      </Button>
    </div>
  );
};

const styles = {
  container: css({
    margin: '1em 0',
  }),
};
