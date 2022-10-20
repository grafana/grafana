import React, { useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export interface VideoPlayerProps {
  options: videojs.PlayerOptions;
  onReady: (player: videojs.Player) => void;
}

export const VideoJSWrapper = (props: VideoPlayerProps) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<videojs.Player>();
  const { options, onReady } = props;

  useEffect(() => {
    // make sure Video.js player is only initialized once
    if (!playerRef.current) {
      const videoElement = videoRef.current;
      if (!videoElement) {
        return;
      }

      const player = (playerRef.current = videojs(videoElement, options, () => {
        console.log('player is ready');
        onReady && onReady(player);
      }));
    } else {
      // you can update player here [update player through props]
      // const player = playerRef.current;
      // player.autoplay(options.autoplay);
      // player.src(options.sources);
    }
  }, [options, videoRef, onReady]);

  // Dispose the Video.js player when the functional component unmounts
  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player) {
        player.dispose();
        playerRef.current = undefined;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="video-js vjs-big-play-centered" />
    </div>
  );
};

export default VideoJSWrapper;
