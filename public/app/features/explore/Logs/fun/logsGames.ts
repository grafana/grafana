import { useEffect, useRef, useState } from 'react';

import { LogLevel, LogRowModel } from '@grafana/data';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

const map = `Score: 000000                              Lives: ♥♥♥♥
================================================================================
                                                                                
                                   [=U=]        
                                                                                
                                                                                
      <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>
      [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]
      <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>
      <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>
                                                                                
                                                                                
            ###              ###              ###              ###            
           #####            #####            #####            #####           
          #######          #######          #######          #######          
           #####            #####            #####            #####           
            ###              ###              ###              ###            
                                                                                
                                                                                

                                                                             
/A\\
================================================================================`;

const player = '/A\\';
const initialPlayerX = 39;
const playerY = 21;

const userMissile = '╫';
const userMissileRegex = new RegExp(userMissile, 'g');
const missileSpeed = 0.06;
type Missile = {
  x: number;
  y: number;
};

export function useLogsGames() {
  const [gameState, setGameState] = useState<LogRowModel[] | undefined>(undefined);
  const [playerX, setPlayerX] = useState(initialPlayerX);
  const [userMissiles, setUserMisiles] = useState<Missile[]>([]);
  const pendingUpdates = useRef(true);

  const lastTime = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    function loop(t: number) {
      const dt = t - lastTime.current;
      lastTime.current = t;

      const { newGameState, newUserMissiles } = update(dt, gameState, playerX, userMissiles);

      setGameState(newGameState);
      setUserMisiles(newUserMissiles);

      frame.current = requestAnimationFrame(loop);
    }

    frame.current = requestAnimationFrame(loop);

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [gameState, playerX, userMissiles]);

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight' && e.code !== 'Space') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      pendingUpdates.current = true;

      if (e.code === 'ArrowLeft') {
        setPlayerX(Math.max(playerX - 1, 0));
      } else if (e.code === 'ArrowRight') {
        setPlayerX(Math.min(playerX + 1, 80));
      } else if (e.code === 'Space' && userMissiles.length < 2) {
        setUserMisiles([...userMissiles, newUserMissile(playerX, playerY - 1)]);
      }
    }
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [playerX, userMissiles]);

  return gameState;
}

function update(dt: number, gameState: LogRowModel[] | undefined, playerX: number, userMissiles: Missile[]) {
  if (gameState === undefined) {
    const logs = map.split('\n').map((row, index) => {
      if (index === playerY) {
        row = row.padStart(initialPlayerX, ' ');
      }
      return createLogRow({
        uid: index.toString(),
        entry: row.padEnd(80),
        timeEpochMs: 0,
        logLevel: LogLevel.unknown,
      });
    });
    return { newGameState: logs, newUserMissiles: userMissiles };
  }

  const newUserMissiles = userMissiles
    .map((missile) => {
      missile.y = missile.y - missileSpeed * dt;
      return missile;
    })
    .filter((missile) => missile.y >= 2);

  const newGameState = gameState.map((row, index) => {
    if (index === playerY) {
      row.entry = player.padStart(playerX, ' ');
    } else {
      row.entry = handleCollisions(row.entry, index, userMissiles);
    }
    return createLogRow({
      uid: index.toString(),
      entry: row.entry.padEnd(80),
      timeEpochMs: 0,
      logLevel: LogLevel.unknown,
    });
  });

  return { newGameState, newUserMissiles };
}

function newUserMissile(x: number, y: number): Missile {
  return {
    x: x - 2,
    y,
  };
}

function handleCollisions(row: string, y: number, userMissiles: Missile[]) {
  const missiles = userMissiles.filter((missile) => Math.ceil(missile.y) === y);

  row = row.replace(userMissileRegex, ' ');

  for (let i = 0; i < missiles.length; i++) {
    if (row.charAt(missiles[i].x) !== ' ') {
      row = row.substring(0, missiles[i].x) + ' ' + row.substring(missiles[i].x + 1);
    } else {
      row = row.substring(0, missiles[i].x) + userMissile + row.substring(missiles[i].x + 1);
    }
  }

  return row;
}
