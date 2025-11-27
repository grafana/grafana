import { useEffect, useRef } from 'react';

import { useDispatch } from 'app/types/store';

import { updateCursor } from '../state/exploreMapSlice';

interface MockUser {
  userId: string;
  userName: string;
  color: string;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  speed: number;
  pauseUntil: number;
}

const MOCK_USERS: Array<Omit<MockUser, 'targetX' | 'targetY' | 'currentX' | 'currentY' | 'pauseUntil'>> = [
  { userId: 'mock-1', userName: 'Christian', color: '#FF6B6B', speed: 8 },
  { userId: 'mock-2', userName: 'Ryan', color: '#4ECDC4', speed: 6 },
  { userId: 'mock-3', userName: 'Marc', color: '#45B7D1', speed: 10 },
];

// Constrain cursors to upper left area of canvas
const MOVEMENT_AREA = {
  minX: 100,
  maxX: 1000,
  minY: 100,
  maxY: 800,
};
const UPDATE_INTERVAL = 50; // ms

function getRandomPosition() {
  return {
    x: Math.random() * (MOVEMENT_AREA.maxX - MOVEMENT_AREA.minX) + MOVEMENT_AREA.minX,
    y: Math.random() * (MOVEMENT_AREA.maxY - MOVEMENT_AREA.minY) + MOVEMENT_AREA.minY,
  };
}

function getRandomPauseDuration() {
  return Math.random() * 1500 + 300; // 300-1800ms pause
}

export function useMockCursors() {
  const dispatch = useDispatch();
  const mockUsersRef = useRef<MockUser[]>([]);
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Initialize mock users
    mockUsersRef.current = MOCK_USERS.map((user) => {
      const startPos = getRandomPosition();
      const targetPos = getRandomPosition();
      return {
        ...user,
        currentX: startPos.x,
        currentY: startPos.y,
        targetX: targetPos.x,
        targetY: targetPos.y,
        pauseUntil: 0,
      };
    });

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateRef.current;

      if (deltaTime >= UPDATE_INTERVAL) {
        lastUpdateRef.current = timestamp;

        mockUsersRef.current = mockUsersRef.current.map((user) => {
          const now = Date.now();

          // If paused, skip movement
          if (now < user.pauseUntil) {
            return user;
          }

          const dx = user.targetX - user.currentX;
          const dy = user.targetY - user.currentY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // If close to target, set new target and maybe pause
          if (distance < 10) {
            const newTarget = getRandomPosition();
            const shouldPause = Math.random() > 0.5; // 50% chance to pause

            return {
              ...user,
              targetX: newTarget.x,
              targetY: newTarget.y,
              pauseUntil: shouldPause ? now + getRandomPauseDuration() : 0,
            };
          }

          // Move towards target
          const moveDistance = user.speed;
          const ratio = moveDistance / distance;
          const newX = user.currentX + dx * ratio;
          const newY = user.currentY + dy * ratio;

          // Update cursor in Redux
          dispatch(
            updateCursor({
              userId: user.userId,
              userName: user.userName,
              color: user.color,
              x: newX,
              y: newY,
              lastUpdated: now,
            })
          );

          return {
            ...user,
            currentX: newX,
            currentY: newY,
          };
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dispatch]);
}
